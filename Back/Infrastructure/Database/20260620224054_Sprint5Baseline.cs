using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class Sprint5Baseline : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AlertasRiesgoDemoraMl",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PaqueteId = table.Column<Guid>(type: "uuid", nullable: false),
                    CodigoSeguimiento = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ProbabilidadDemora = table.Column<float>(type: "real", nullable: false),
                    CausaPrincipal = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    SucursalId = table.Column<Guid>(type: "uuid", nullable: false),
                    GeneradaEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Gestionada = table.Column<bool>(type: "boolean", nullable: false),
                    GestionadaEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SupervisorId = table.Column<Guid>(type: "uuid", nullable: true),
                    LlegoATiempo = table.Column<bool>(type: "boolean", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AlertasRiesgoDemoraMl", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CalificacionesPickUp",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PuntoPickUpId = table.Column<Guid>(type: "uuid", nullable: false),
                    PaqueteId = table.Column<Guid>(type: "uuid", nullable: false),
                    Estrellas = table.Column<int>(type: "integer", nullable: false),
                    Comentario = table.Column<string>(type: "text", nullable: true),
                    AutorNombre = table.Column<string>(type: "text", nullable: true),
                    CreadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalificacionesPickUp", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ConfiguracionesOjoPatron",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Provincia = table.Column<string>(type: "text", nullable: false),
                    UmbralAlertness = table.Column<double>(type: "double precision", nullable: false),
                    Activo = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    ActualizadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConfiguracionesOjoPatron", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ConfiguracionesTarifa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Provincia = table.Column<string>(type: "text", nullable: false),
                    PrecioPorKg = table.Column<double>(type: "double precision", nullable: false),
                    PrecioPorKm = table.Column<double>(type: "double precision", nullable: false),
                    PorcentajeRecargoZonaPeligrosa = table.Column<double>(type: "double precision", nullable: false),
                    ActualizadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConfiguracionesTarifa", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ConsentimientosOjoPatron",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    VersionTexto = table.Column<string>(type: "text", nullable: false),
                    AceptadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RevocadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConsentimientosOjoPatron", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DatosEntrenamientoTramo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PaqueteId = table.Column<Guid>(type: "uuid", nullable: false),
                    TramoId = table.Column<Guid>(type: "uuid", nullable: true),
                    SucursalOrigenId = table.Column<Guid>(type: "uuid", nullable: false),
                    SucursalDestinoId = table.Column<Guid>(type: "uuid", nullable: false),
                    FechaSalida = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FechaLlegada = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TiempoRealHoras = table.Column<double>(type: "double precision", nullable: false),
                    PesoKg = table.Column<double>(type: "double precision", nullable: false),
                    TipoEnvio = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    EsPrioritario = table.Column<bool>(type: "boolean", nullable: false),
                    DiaSemana = table.Column<int>(type: "integer", nullable: false),
                    HoraSalida = table.Column<int>(type: "integer", nullable: false),
                    CargaSucursalOrigen = table.Column<int>(type: "integer", nullable: false),
                    RepartidoresActivosDestino = table.Column<int>(type: "integer", nullable: false),
                    TuvoDemora = table.Column<bool>(type: "boolean", nullable: false),
                    EstimacionPreviaHoras = table.Column<double>(type: "double precision", nullable: true),
                    ErrorAbsolutoHoras = table.Column<double>(type: "double precision", nullable: true),
                    RegistradoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DatosEntrenamientoTramo", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EmailNotificaciones",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PaqueteId = table.Column<Guid>(type: "uuid", nullable: true),
                    SucursalId = table.Column<Guid>(type: "uuid", nullable: true),
                    CodigoSeguimiento = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    DestinatarioEmail = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Asunto = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    Cuerpo = table.Column<string>(type: "text", nullable: false),
                    Evento = table.Column<int>(type: "integer", nullable: false),
                    Estado = table.Column<int>(type: "integer", nullable: false),
                    CreadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EnviadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Error = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Intentos = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmailNotificaciones", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Empresas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nombre = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Plan = table.Column<int>(type: "integer", nullable: false),
                    LimiteCuentas = table.Column<int>(type: "integer", nullable: false),
                    Estado = table.Column<int>(type: "integer", nullable: false),
                    CreadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ActualizadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LicenciasAlertaDias = table.Column<int>(type: "integer", nullable: false),
                    LicenciasUrgenteDias = table.Column<int>(type: "integer", nullable: false),
                    LicenciasHoraProcesoMinutos = table.Column<int>(type: "integer", nullable: false),
                    CodigoCambioPendiente = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    PlanDestinoPendiente = table.Column<int>(type: "integer", nullable: true),
                    LimiteDestinoPendiente = table.Column<int>(type: "integer", nullable: true),
                    IntentosCodigoFallidos = table.Column<int>(type: "integer", nullable: false),
                    CodigoEmitidoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Empresas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GerentesProvincias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GerenteId = table.Column<Guid>(type: "uuid", nullable: false),
                    Provincia = table.Column<string>(type: "text", nullable: false),
                    CreadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GerentesProvincias", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GerentesSucursales",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GerenteId = table.Column<Guid>(type: "uuid", nullable: false),
                    SucursalId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GerentesSucursales", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HistorialEstadosEnvio",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PaqueteId = table.Column<Guid>(type: "uuid", nullable: false),
                    EstadoNuevo = table.Column<int>(type: "integer", nullable: false),
                    FechaHora = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: true),
                    Origen = table.Column<int>(type: "integer", nullable: false),
                    Motivo = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HistorialEstadosEnvio", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Incidencias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PaqueteId = table.Column<Guid>(type: "uuid", nullable: true),
                    CodigoSeguimiento = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    SucursalId = table.Column<Guid>(type: "uuid", nullable: true),
                    RepartidorId = table.Column<Guid>(type: "uuid", nullable: true),
                    RepartidorNombre = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Origen = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Tipo = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    TipoLabel = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Descripcion = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Estado = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    FechaReporte = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Severidad = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SlaVenceEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ResueltaEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EmailContacto = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    ChatFinalizado = table.Column<bool>(type: "boolean", nullable: false),
                    ParadasAfectadasJson = table.Column<string>(type: "text", nullable: false),
                    ObservacionesJson = table.Column<string>(type: "text", nullable: false),
                    HistorialEstadosJson = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Incidencias", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LogsAuditoria",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: true),
                    UsuarioNombre = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    UsuarioRol = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Accion = table.Column<int>(type: "integer", nullable: false),
                    RecursoId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Descripcion = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Contexto = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LogsAuditoria", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MensajesIncidencia",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    IncidenciaId = table.Column<Guid>(type: "uuid", nullable: false),
                    De = table.Column<string>(type: "text", nullable: false),
                    DeNombre = table.Column<string>(type: "text", nullable: false),
                    DeRol = table.Column<string>(type: "text", nullable: false),
                    Texto = table.Column<string>(type: "text", nullable: false),
                    Fecha = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LeidoPorRepartidor = table.Column<bool>(type: "boolean", nullable: false),
                    LeidoPorSupervisor = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MensajesIncidencia", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ModeloVersionesTramo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EntrenadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RegistrosUsados = table.Column<int>(type: "integer", nullable: false),
                    MaeModelo = table.Column<double>(type: "double precision", nullable: false),
                    MaeHeuristico = table.Column<double>(type: "double precision", nullable: false),
                    Algoritmo = table.Column<string>(type: "text", nullable: false),
                    Version = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModeloVersionesTramo", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OverridesOjoPatron",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RepartidorId = table.Column<Guid>(type: "uuid", nullable: false),
                    SupervisorId = table.Column<Guid>(type: "uuid", nullable: true),
                    Momento = table.Column<int>(type: "integer", nullable: false),
                    Motivo = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Estado = table.Column<int>(type: "integer", nullable: false),
                    SolicitadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ResueltoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ComentarioSupervisor = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OverridesOjoPatron", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PermisosRol",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Rol = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Permiso = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Habilitado = table.Column<bool>(type: "boolean", nullable: false),
                    ActualizadoPorId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActualizadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PermisosRol", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PlantillasEmail",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Provincia = table.Column<string>(type: "text", nullable: false),
                    Evento = table.Column<int>(type: "integer", nullable: false),
                    Asunto = table.Column<string>(type: "text", nullable: false),
                    Cuerpo = table.Column<string>(type: "text", nullable: false),
                    ModificadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ModificadoPorId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlantillasEmail", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PruebasOjoPatron",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    FechaHora = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ScoreNeu = table.Column<double>(type: "double precision", nullable: false),
                    ScoreHap = table.Column<double>(type: "double precision", nullable: false),
                    ScoreSad = table.Column<double>(type: "double precision", nullable: false),
                    ScoreAng = table.Column<double>(type: "double precision", nullable: false),
                    AlertnessScore = table.Column<double>(type: "double precision", nullable: false),
                    UmbralUsado = table.Column<double>(type: "double precision", nullable: false),
                    Intentos = table.Column<int>(type: "integer", nullable: false),
                    Resultado = table.Column<int>(type: "integer", nullable: false),
                    Momento = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PruebasOjoPatron", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PuntosPickUp",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nombre = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Direccion = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    Localidad = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    CodigoPostal = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Provincia = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Horarios = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    CapacidadDiaria = table.Column<int>(type: "integer", nullable: false, defaultValue: 100),
                    Telefono = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Activo = table.Column<bool>(type: "boolean", nullable: false),
                    CreadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PuntosPickUp", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SolicitudesComerciales",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    NombreEmpresa = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    NombreContacto = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Email = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Telefono = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PlanInteres = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Comentarios = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Estado = table.Column<int>(type: "integer", nullable: false),
                    CreadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SolicitudesComerciales", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Sucursales",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nombre = table.Column<string>(type: "text", nullable: false),
                    Direccion = table.Column<string>(type: "text", nullable: false),
                    Ciudad = table.Column<string>(type: "text", nullable: false),
                    CodigoPostal = table.Column<string>(type: "text", nullable: false),
                    Provincia = table.Column<string>(type: "text", nullable: true),
                    Telefono = table.Column<string>(type: "text", nullable: false),
                    Estado = table.Column<int>(type: "integer", nullable: false),
                    CapacidadAlmacenamientoPaquetes = table.Column<int>(type: "integer", nullable: false, defaultValue: 1000),
                    ProvinciasCubiertas = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sucursales", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Usuarios",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nombre = table.Column<string>(type: "text", nullable: false),
                    Apellido = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    Password = table.Column<string>(type: "text", nullable: false),
                    DNI = table.Column<string>(type: "text", nullable: false),
                    Activo = table.Column<bool>(type: "boolean", nullable: false),
                    AccessFailedCount = table.Column<int>(type: "integer", nullable: false),
                    BloqueadoHasta = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FailedLoginAttempts = table.Column<int>(type: "integer", nullable: false),
                    LockoutUntilUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SucursalId = table.Column<Guid>(type: "uuid", nullable: true),
                    FotoPerfil = table.Column<string>(type: "text", nullable: true),
                    Discriminator = table.Column<string>(type: "character varying(13)", maxLength: 13, nullable: false),
                    Provincia = table.Column<string>(type: "text", nullable: true),
                    SucursalActivaId = table.Column<Guid>(type: "uuid", nullable: true),
                    Licencia = table.Column<string>(type: "text", nullable: true),
                    FechaVencimientoLicencia = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Estado = table.Column<int>(type: "integer", nullable: true),
                    MotivoSuspension = table.Column<string>(type: "text", nullable: true),
                    EstadoJornada = table.Column<int>(type: "integer", nullable: true),
                    HorasTrabajo = table.Column<int>(type: "integer", nullable: true),
                    CapacidadCargaKg = table.Column<double>(type: "double precision", nullable: true, defaultValue: 500.0),
                    PuntoPickUpId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Usuarios", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Vehiculos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Patente = table.Column<string>(type: "text", nullable: false),
                    Marca = table.Column<string>(type: "text", nullable: false),
                    CapacidadCarga = table.Column<double>(type: "double precision", nullable: false),
                    Estado = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Vehiculos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ZonasPeligrosas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nombre = table.Column<string>(type: "text", nullable: false),
                    Provincia = table.Column<string>(type: "text", nullable: false),
                    LatMin = table.Column<double>(type: "double precision", nullable: false),
                    LatMax = table.Column<double>(type: "double precision", nullable: false),
                    LngMin = table.Column<double>(type: "double precision", nullable: false),
                    LngMax = table.Column<double>(type: "double precision", nullable: false),
                    Activa = table.Column<bool>(type: "boolean", nullable: false),
                    CreadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ZonasPeligrosas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HorariosPickUp",
                columns: table => new
                {
                    PuntoPickUpId = table.Column<Guid>(type: "uuid", nullable: false),
                    DiaSemana = table.Column<int>(type: "integer", nullable: false),
                    Apertura = table.Column<TimeSpan>(type: "interval", nullable: true),
                    Cierre = table.Column<TimeSpan>(type: "interval", nullable: true),
                    Cerrado = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HorariosPickUp", x => new { x.PuntoPickUpId, x.DiaSemana });
                    table.ForeignKey(
                        name: "FK_HorariosPickUp_PuntosPickUp_PuntoPickUpId",
                        column: x => x.PuntoPickUpId,
                        principalTable: "PuntosPickUp",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PermisosUsuario",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Permiso = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Habilitado = table.Column<bool>(type: "boolean", nullable: false),
                    ActualizadoPorId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActualizadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SucursalesPermitidasIds = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PermisosUsuario", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PermisosUsuario_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Rutas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Estado = table.Column<int>(type: "integer", nullable: false),
                    IniciadoEn = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    FinalizadoEn = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RazonCancelacion = table.Column<string>(type: "text", nullable: true),
                    RepartidorId = table.Column<Guid>(type: "uuid", nullable: false),
                    VehiculoId = table.Column<Guid>(type: "uuid", nullable: false),
                    UbicacionActualLat = table.Column<double>(type: "double precision", nullable: true),
                    UbicacionActualLng = table.Column<double>(type: "double precision", nullable: true),
                    UbicacionActualizadaEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Rutas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Rutas_Usuarios_RepartidorId",
                        column: x => x.RepartidorId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Rutas_Vehiculos_VehiculoId",
                        column: x => x.VehiculoId,
                        principalTable: "Vehiculos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Paquetes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CodigoSeguimiento = table.Column<string>(type: "text", nullable: false),
                    CodigoEntrega = table.Column<string>(type: "character varying(6)", maxLength: 6, nullable: false),
                    Peso = table.Column<double>(type: "double precision", nullable: false),
                    Altura = table.Column<double>(type: "double precision", nullable: false),
                    Ancho = table.Column<double>(type: "double precision", nullable: false),
                    Prioridad = table.Column<float>(type: "real", nullable: false),
                    CreadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TipoEnvio = table.Column<int>(type: "integer", nullable: false),
                    TipoPaquete = table.Column<int>(type: "integer", nullable: false),
                    Remitente_Nombre = table.Column<string>(type: "text", nullable: false),
                    Remitente_Apellido = table.Column<string>(type: "text", nullable: false),
                    Remitente_Telefono = table.Column<string>(type: "text", nullable: true),
                    Remitente_Email = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Remitente_Direccion_Calle = table.Column<string>(type: "text", nullable: false),
                    Remitente_Direccion_Ciudad = table.Column<string>(type: "text", nullable: false),
                    Remitente_Direccion_CP = table.Column<string>(type: "text", nullable: false),
                    Remitente_Direccion_Provincia = table.Column<string>(type: "text", nullable: true),
                    Remitente_Direccion_Referencia = table.Column<string>(type: "text", nullable: true),
                    Remitente_Ubicacion_Latitud = table.Column<double>(type: "double precision", nullable: true),
                    Remitente_Ubicacion_Longitud = table.Column<double>(type: "double precision", nullable: true),
                    Destinatario_Nombre = table.Column<string>(type: "text", nullable: false),
                    Destinatario_Apellido = table.Column<string>(type: "text", nullable: false),
                    Destinatario_Telefono = table.Column<string>(type: "text", nullable: true),
                    Destinatario_Email = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Destinatario_Direccion_Calle = table.Column<string>(type: "text", nullable: false),
                    Destinatario_Direccion_Ciudad = table.Column<string>(type: "text", nullable: false),
                    Destinatario_Direccion_CP = table.Column<string>(type: "text", nullable: false),
                    Destinatario_Direccion_Provincia = table.Column<string>(type: "text", nullable: true),
                    Destinatario_Direccion_Referencia = table.Column<string>(type: "text", nullable: true),
                    Destinatario_Ubicacion_Latitud = table.Column<double>(type: "double precision", nullable: true),
                    Destinatario_Ubicacion_Longitud = table.Column<double>(type: "double precision", nullable: true),
                    Descripcion = table.Column<string>(type: "text", nullable: true),
                    RazonCancelacion = table.Column<string>(type: "text", nullable: true),
                    RazonDemora = table.Column<string>(type: "text", nullable: true),
                    Distancia = table.Column<float>(type: "real", nullable: false),
                    HorasEstimadasRuta = table.Column<float>(type: "real", nullable: false),
                    CostoEnvio = table.Column<double>(type: "double precision", nullable: false),
                    CostoRecargoSeguridad = table.Column<double>(type: "double precision", nullable: false),
                    EsZonaPeligrosa = table.Column<bool>(type: "boolean", nullable: false),
                    FechaCalendarizada = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FechaEstimadaEntrega = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DiasEstimadosEntrega = table.Column<int>(type: "integer", nullable: false),
                    RepartidorAsignadoId = table.Column<Guid>(type: "uuid", nullable: true),
                    UbicacionActual_Latitud = table.Column<double>(type: "double precision", nullable: true),
                    UbicacionActual_Longitud = table.Column<double>(type: "double precision", nullable: true),
                    UbicacionActualActualizadaEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SucursalId = table.Column<Guid>(type: "uuid", nullable: true),
                    ProvinciaDestino = table.Column<string>(type: "text", nullable: true),
                    EsEnvioADomicilio = table.Column<bool>(type: "boolean", nullable: false),
                    PuntoPickUpId = table.Column<Guid>(type: "uuid", nullable: true),
                    RequiereRepartidorFullTime = table.Column<bool>(type: "boolean", nullable: false),
                    RutaId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Paquetes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Paquetes_Rutas_RutaId",
                        column: x => x.RutaId,
                        principalTable: "Rutas",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "SatisfaccionEncuestas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PaqueteId = table.Column<Guid>(type: "uuid", nullable: false),
                    Token = table.Column<Guid>(type: "uuid", nullable: false),
                    Calificacion = table.Column<int>(type: "integer", nullable: true),
                    Comentario = table.Column<string>(type: "text", nullable: true),
                    RespuestaEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SatisfaccionEncuestas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SatisfaccionEncuestas_Paquetes_PaqueteId",
                        column: x => x.PaqueteId,
                        principalTable: "Paquetes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TramosEnvio",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PaqueteId = table.Column<Guid>(type: "uuid", nullable: false),
                    Orden = table.Column<int>(type: "integer", nullable: false),
                    SucursalOrigenId = table.Column<Guid>(type: "uuid", nullable: false),
                    SucursalDestinoId = table.Column<Guid>(type: "uuid", nullable: true),
                    RepartidorId = table.Column<Guid>(type: "uuid", nullable: true),
                    EsUltimaMilla = table.Column<bool>(type: "boolean", nullable: false),
                    DistanciaKm = table.Column<double>(type: "double precision", nullable: false),
                    HorasEstimadas = table.Column<double>(type: "double precision", nullable: false),
                    Estado = table.Column<int>(type: "integer", nullable: false),
                    IniciadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FinalizadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TramosEnvio", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TramosEnvio_Paquetes_PaqueteId",
                        column: x => x.PaqueteId,
                        principalTable: "Paquetes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TramosEnvio_Sucursales_SucursalDestinoId",
                        column: x => x.SucursalDestinoId,
                        principalTable: "Sucursales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TramosEnvio_Sucursales_SucursalOrigenId",
                        column: x => x.SucursalOrigenId,
                        principalTable: "Sucursales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AlertasRiesgoDemoraMl_PaqueteId",
                table: "AlertasRiesgoDemoraMl",
                column: "PaqueteId");

            migrationBuilder.CreateIndex(
                name: "IX_DatosEntrenamientoTramo_SucursalOrigen_Destino",
                table: "DatosEntrenamientoTramo",
                columns: new[] { "SucursalOrigenId", "SucursalDestinoId" });

            migrationBuilder.CreateIndex(
                name: "IX_EmailNotificaciones_CreadoEn",
                table: "EmailNotificaciones",
                column: "CreadoEn");

            migrationBuilder.CreateIndex(
                name: "IX_EmailNotificaciones_Estado",
                table: "EmailNotificaciones",
                column: "Estado");

            migrationBuilder.CreateIndex(
                name: "IX_EmailNotificaciones_PaqueteId",
                table: "EmailNotificaciones",
                column: "PaqueteId");

            migrationBuilder.CreateIndex(
                name: "IX_EmailNotificaciones_SucursalId",
                table: "EmailNotificaciones",
                column: "SucursalId");

            migrationBuilder.CreateIndex(
                name: "IX_HistorialEstadosEnvio_FechaHora",
                table: "HistorialEstadosEnvio",
                column: "FechaHora");

            migrationBuilder.CreateIndex(
                name: "IX_HistorialEstadosEnvio_PaqueteId",
                table: "HistorialEstadosEnvio",
                column: "PaqueteId");

            migrationBuilder.CreateIndex(
                name: "IX_Incidencias_FechaReporte",
                table: "Incidencias",
                column: "FechaReporte");

            migrationBuilder.CreateIndex(
                name: "IX_Incidencias_PaqueteId",
                table: "Incidencias",
                column: "PaqueteId");

            migrationBuilder.CreateIndex(
                name: "IX_Incidencias_SucursalId",
                table: "Incidencias",
                column: "SucursalId");

            migrationBuilder.CreateIndex(
                name: "IX_LogsAuditoria_Accion",
                table: "LogsAuditoria",
                column: "Accion");

            migrationBuilder.CreateIndex(
                name: "IX_LogsAuditoria_Timestamp",
                table: "LogsAuditoria",
                column: "Timestamp");

            migrationBuilder.CreateIndex(
                name: "IX_LogsAuditoria_UsuarioId",
                table: "LogsAuditoria",
                column: "UsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_OverridesOjoPatron_RepartidorId",
                table: "OverridesOjoPatron",
                column: "RepartidorId");

            migrationBuilder.CreateIndex(
                name: "IX_OverridesOjoPatron_SolicitadoEn",
                table: "OverridesOjoPatron",
                column: "SolicitadoEn");

            migrationBuilder.CreateIndex(
                name: "IX_OverridesOjoPatron_SupervisorId",
                table: "OverridesOjoPatron",
                column: "SupervisorId");

            migrationBuilder.CreateIndex(
                name: "IX_Paquetes_RutaId",
                table: "Paquetes",
                column: "RutaId");

            migrationBuilder.CreateIndex(
                name: "IX_PermisosRol_Rol_Permiso",
                table: "PermisosRol",
                columns: new[] { "Rol", "Permiso" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PermisosUsuario_UsuarioId_Permiso",
                table: "PermisosUsuario",
                columns: new[] { "UsuarioId", "Permiso" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PuntosPickUp_Activo",
                table: "PuntosPickUp",
                column: "Activo");

            migrationBuilder.CreateIndex(
                name: "IX_PuntosPickUp_Provincia",
                table: "PuntosPickUp",
                column: "Provincia");

            migrationBuilder.CreateIndex(
                name: "IX_Rutas_RepartidorId",
                table: "Rutas",
                column: "RepartidorId");

            migrationBuilder.CreateIndex(
                name: "IX_Rutas_VehiculoId",
                table: "Rutas",
                column: "VehiculoId");

            migrationBuilder.CreateIndex(
                name: "IX_SatisfaccionEncuestas_PaqueteId",
                table: "SatisfaccionEncuestas",
                column: "PaqueteId");

            migrationBuilder.CreateIndex(
                name: "IX_SatisfaccionEncuestas_Token",
                table: "SatisfaccionEncuestas",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SolicitudesComerciales_CreadoEn",
                table: "SolicitudesComerciales",
                column: "CreadoEn");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitudesComerciales_Email",
                table: "SolicitudesComerciales",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_TramosEnvio_PaqueteId_Orden",
                table: "TramosEnvio",
                columns: new[] { "PaqueteId", "Orden" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TramosEnvio_SucursalDestinoId_Estado",
                table: "TramosEnvio",
                columns: new[] { "SucursalDestinoId", "Estado" });

            migrationBuilder.CreateIndex(
                name: "IX_TramosEnvio_SucursalOrigenId_Estado",
                table: "TramosEnvio",
                columns: new[] { "SucursalOrigenId", "Estado" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AlertasRiesgoDemoraMl");

            migrationBuilder.DropTable(
                name: "CalificacionesPickUp");

            migrationBuilder.DropTable(
                name: "ConfiguracionesOjoPatron");

            migrationBuilder.DropTable(
                name: "ConfiguracionesTarifa");

            migrationBuilder.DropTable(
                name: "ConsentimientosOjoPatron");

            migrationBuilder.DropTable(
                name: "DatosEntrenamientoTramo");

            migrationBuilder.DropTable(
                name: "EmailNotificaciones");

            migrationBuilder.DropTable(
                name: "Empresas");

            migrationBuilder.DropTable(
                name: "GerentesProvincias");

            migrationBuilder.DropTable(
                name: "GerentesSucursales");

            migrationBuilder.DropTable(
                name: "HistorialEstadosEnvio");

            migrationBuilder.DropTable(
                name: "HorariosPickUp");

            migrationBuilder.DropTable(
                name: "Incidencias");

            migrationBuilder.DropTable(
                name: "LogsAuditoria");

            migrationBuilder.DropTable(
                name: "MensajesIncidencia");

            migrationBuilder.DropTable(
                name: "ModeloVersionesTramo");

            migrationBuilder.DropTable(
                name: "OverridesOjoPatron");

            migrationBuilder.DropTable(
                name: "PermisosRol");

            migrationBuilder.DropTable(
                name: "PermisosUsuario");

            migrationBuilder.DropTable(
                name: "PlantillasEmail");

            migrationBuilder.DropTable(
                name: "PruebasOjoPatron");

            migrationBuilder.DropTable(
                name: "SatisfaccionEncuestas");

            migrationBuilder.DropTable(
                name: "SolicitudesComerciales");

            migrationBuilder.DropTable(
                name: "TramosEnvio");

            migrationBuilder.DropTable(
                name: "ZonasPeligrosas");

            migrationBuilder.DropTable(
                name: "PuntosPickUp");

            migrationBuilder.DropTable(
                name: "Paquetes");

            migrationBuilder.DropTable(
                name: "Sucursales");

            migrationBuilder.DropTable(
                name: "Rutas");

            migrationBuilder.DropTable(
                name: "Usuarios");

            migrationBuilder.DropTable(
                name: "Vehiculos");
        }
    }
}
