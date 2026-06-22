using Back.Application.Services;
using Back.Application.Abstractions;
using Back.Domain.Repositories;
using System.Text.Json;
using System.Text.Json.Serialization;
using Back.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Back.Infrastructure.Database.Repositories;
using System.Reflection;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.Extensions.ML;
using Back.Ml.Service;
using Back.Background;
using Back.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// --- CONFIGURACIÓN DE SERVICIOS (Dependency Injection) ---

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// Configuración de Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath)) 
    {
        options.IncludeXmlComments(xmlPath);
    }
});

// Configuración de CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Base de Datos
var connectionString = builder.Configuration.GetConnectionString("PostgresConnection");
builder.Services.AddDbContext<LogiTrackDbContext>(options =>
    options.UseNpgsql(connectionString));

// Inyección de Dependencias de la Lógica de Negocio
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<EnviosService>();
builder.Services.AddScoped<PlanificacionTramosService>();
builder.Services.AddScoped<RutasService>();
builder.Services.AddScoped<CalendarizacionService>();
builder.Services.AddScoped<RutasActivasService>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<AuditoriaService>();
builder.Services.AddScoped<RepartidoresMetricsService>();
builder.Services.AddScoped<ReportesService>();
builder.Services.AddScoped<TarifaService>();
builder.Services.AddScoped<OjoPatronService>();
builder.Services.AddScoped<AlertasService>();
builder.Services.AddScoped<EmpresaService>();
builder.Services.AddScoped<HistorialEstadoEnvioService>();
builder.Services.AddScoped<PermisosService>();
builder.Services.AddScoped<EstimacionEntregaService>();
builder.Services.AddSingleton<IAuthorizationMiddlewareResultHandler, PermissionAuthorizationResultHandler>();
builder.Services.AddSingleton<QrService>();
builder.Services.AddScoped<DatabaseSeeder>();
builder.Services.AddHttpClient<IRecaptchaValidationService, GoogleRecaptchaValidationService>();
builder.Services.AddHttpClient<GeocodingService>(c =>
{
    c.DefaultRequestHeaders.UserAgent.ParseAdd("LogiTrack/1.0 (laboratorio-universitario)");
    c.Timeout = TimeSpan.FromSeconds(10);
});
// Registrar el HttpClient
builder.Services.AddHttpClient();
builder.Services.AddHealthChecks();
builder.Services.AddSignalR();
// Registrar el servicio de fondo
builder.Services.AddHostedService<UptimerService>();
builder.Services.AddHostedService<LicenciasRepartidoresService>();
builder.Services.AddScoped<IUserRepository, UsuariosRepository>();
builder.Services.AddScoped<IEnviosRepository, EnviosRepository>();
builder.Services.AddScoped<IVehiculoRepository, VehiculosRepository>();
builder.Services.AddScoped<IRutasRepository, RutasRepository>();
builder.Services.AddScoped<EmailNotificacionService>();
builder.Services.AddScoped<EnviosExcelImportService>();
builder.Services.AddScoped<Back.Domain.Repositories.IGerenteProvinciaRepository, Back.Infrastructure.Database.Repositories.GerenteProvinciaRepository>();
builder.Services.AddScoped<Back.Domain.Repositories.IGerenteSucursalRepository, Back.Infrastructure.Database.Repositories.GerenteSucursalRepository>();

// Configuración de Autenticación JWT
var jwtSecretKey = "Grupo8SuperSecretKeyWithAtLeast32Characters";
var key = Encoding.ASCII.GetBytes(jwtSecretKey);

string rootPath = AppContext.BaseDirectory;
string modelz = Path.Combine(rootPath, "ML","Models", "prioridad_model.zip");

builder.Services.AddPredictionEnginePool<PaqueteData, PrioridadPrediction>().FromFile(modelz);

builder.Services.AddScoped<IMLPrioridadPrediction, MLNetPrioridadService>();

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(key),
            ValidateIssuer = true,
            ValidIssuer = "LogiTrack",
            ValidateAudience = true,
            ValidAudience = "LogiTrack",
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

const string BaselineMigrationId = "20260620224054_Sprint5Baseline";
const string EfProductVersion = "10.0.1";

static async Task<bool> TableExistsAsync(LogiTrackDbContext context, string tableName)
{
    var connection = context.Database.GetDbConnection();
    var shouldClose = connection.State != System.Data.ConnectionState.Open;

    if (shouldClose)
    {
        await connection.OpenAsync();
    }

    try
    {
        await using var command = connection.CreateCommand();
        command.CommandText = @"
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = @tableName
            );";

        var parameter = command.CreateParameter();
        parameter.ParameterName = "@tableName";
        parameter.Value = tableName;
        command.Parameters.Add(parameter);

        var result = await command.ExecuteScalarAsync();
        return result is true || (result is bool exists && exists);
    }
    finally
    {
        if (shouldClose)
        {
            await connection.CloseAsync();
        }
    }
}

static async Task EnsureBaselineMigrationHistoryAsync(LogiTrackDbContext context)
{
    var pendingMigrations = await context.Database.GetPendingMigrationsAsync();
    if (!pendingMigrations.Contains(BaselineMigrationId))
    {
        return;
    }

    // Si la base ya fue creada fuera del historial de EF, registramos la baseline
    // para evitar que MigrateAsync intente recrear todas las tablas.
    var representativeTables = new[] { "Usuarios", "Paquetes", "PuntosPickUp", "CalificacionesPickUp" };
    foreach (var table in representativeTables)
    {
        if (!await TableExistsAsync(context, table))
        {
            return;
        }
    }

    await context.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""__EFMigrationsHistory"" (
            ""MigrationId"" character varying(150) NOT NULL,
            ""ProductVersion"" character varying(32) NOT NULL,
            CONSTRAINT ""PK___EFMigrationsHistory"" PRIMARY KEY (""MigrationId"")
        );
    ");

    await context.Database.ExecuteSqlInterpolatedAsync($@"
        INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
        SELECT {BaselineMigrationId}, {EfProductVersion}
        WHERE NOT EXISTS (
            SELECT 1
            FROM ""__EFMigrationsHistory""
            WHERE ""MigrationId"" = {BaselineMigrationId}
        );
    ");
}


// --- CONFIGURACIÓN DEL PIPELINE DE PETICIONES (HTTP Request Pipeline) ---

// 1. Swagger siempre disponible al inicio
app.UseSwagger();
app.UseSwaggerUI();

// 2. Routing: Crucial para que CORS sepa a qué endpoint va la petición
app.UseRouting();

// 3. CORS: Debe ir después de Routing y ANTES de Auth
app.UseCors("AllowAll");

// 4. Seguridad: Autenticación antes que Autorización
app.UseAuthentication();
app.UseAuthorization();

// 5. Mapeo de Controladores
app.MapControllers();
app.MapHub<UbicacionHub>("/hubs/ubicacion");
app.MapHealthChecks("api/health");

// --- TAREAS DE INICIO (Migraciones y Seed) ---

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try 
    {
        var context = services.GetRequiredService<LogiTrackDbContext>();
        await EnsureBaselineMigrationHistoryAsync(context);
        await context.Database.MigrateAsync();

        // Garantizar Empresa singleton (G1L-52..64)
        var empresaService = services.GetRequiredService<EmpresaService>();
        await empresaService.GetOrCreateSingletonAsync();

        // Garantizar usuarios demo siempre (independiente del flag del seeder).
        var seeder = services.GetRequiredService<DatabaseSeeder>();
        await seeder.AsegurarUsuariosDemoAsync();

        var configuration = services.GetRequiredService<IConfiguration>();
        if (configuration.GetValue<bool>("EnableDatabaseSeeder"))
        {
            await seeder.SeedAsync();
        }
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Ocurrió un error durante la migración o el seeding de la base de datos.");
    }
}


 
app.Run();// Verificar existencia del modelo de ML en ruta relativa para despliegue
