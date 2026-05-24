using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class Sprint3IncidenciasPersistidas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Incidencias");
        }
    }
}
