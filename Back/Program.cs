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
builder.Services.AddScoped<RutasService>();
builder.Services.AddScoped<HistorialEstadoEnvioService>();
builder.Services.AddSingleton<QrService>();
builder.Services.AddScoped<DatabaseSeeder>();
builder.Services.AddHttpClient<IRecaptchaValidationService, GoogleRecaptchaValidationService>();
// Registrar el HttpClient
builder.Services.AddHttpClient();
builder.Services.AddHealthChecks();
// Registrar el servicio de fondo
builder.Services.AddHostedService<UptimerService>();
builder.Services.AddScoped<IUserRepository, UsuariosRepository>();
builder.Services.AddScoped<IEnviosRepository, EnviosRepository>();
builder.Services.AddScoped<IVehiculoRepository, VehiculosRepository>();
builder.Services.AddScoped<IRutasRepository, RutasRepository>();

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
app.MapHealthChecks("api/health");

// --- TAREAS DE INICIO (Migraciones y Seed) ---

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try 
    {
        var context = services.GetRequiredService<LogiTrackDbContext>();
        await context.Database.MigrateAsync();

        var configuration = services.GetRequiredService<IConfiguration>();
        if (configuration.GetValue<bool>("EnableDatabaseSeeder"))
        {
            var seeder = services.GetRequiredService<DatabaseSeeder>();
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
