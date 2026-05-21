using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class Sprint3Tarifas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ConfiguracionesTarifa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
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
                name: "ZonasPeligrosas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nombre = table.Column<string>(type: "text", nullable: false),
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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ConfiguracionesTarifa");

            migrationBuilder.DropTable(
                name: "ZonasPeligrosas");
        }
    }
}
