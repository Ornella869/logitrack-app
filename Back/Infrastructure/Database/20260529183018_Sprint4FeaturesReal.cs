using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class Sprint4FeaturesReal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AccessFailedCount",
                table: "Usuarios",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "BloqueadoHasta",
                table: "Usuarios",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Destinatario_Email",
                table: "Paquetes",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DiasEstimadosEntrega",
                table: "Paquetes",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "FechaEstimadaEntrega",
                table: "Paquetes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PuntoPickUpId",
                table: "Paquetes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Remitente_Email",
                table: "Paquetes",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UbicacionActualActualizadaEn",
                table: "Paquetes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Severidad",
                table: "Incidencias",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "SlaVenceEn",
                table: "Incidencias",
                type: "timestamp with time zone",
                nullable: true);

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
                    Cuerpo = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
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
                    Telefono = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Activo = table.Column<bool>(type: "boolean", nullable: false),
                    CreadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PuntosPickUp", x => x.Id);
                });

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
                name: "IX_PuntosPickUp_Activo",
                table: "PuntosPickUp",
                column: "Activo");

            migrationBuilder.CreateIndex(
                name: "IX_PuntosPickUp_Provincia",
                table: "PuntosPickUp",
                column: "Provincia");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmailNotificaciones");

            migrationBuilder.DropTable(
                name: "OverridesOjoPatron");

            migrationBuilder.DropTable(
                name: "PuntosPickUp");

            migrationBuilder.DropColumn(
                name: "AccessFailedCount",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "BloqueadoHasta",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "Destinatario_Email",
                table: "Paquetes");

            migrationBuilder.DropColumn(
                name: "DiasEstimadosEntrega",
                table: "Paquetes");

            migrationBuilder.DropColumn(
                name: "FechaEstimadaEntrega",
                table: "Paquetes");

            migrationBuilder.DropColumn(
                name: "PuntoPickUpId",
                table: "Paquetes");

            migrationBuilder.DropColumn(
                name: "Remitente_Email",
                table: "Paquetes");

            migrationBuilder.DropColumn(
                name: "UbicacionActualActualizadaEn",
                table: "Paquetes");

            migrationBuilder.DropColumn(
                name: "Severidad",
                table: "Incidencias");

            migrationBuilder.DropColumn(
                name: "SlaVenceEn",
                table: "Incidencias");
        }
    }
}
