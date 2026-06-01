using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class AddRutaUbicacion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "UbicacionActualLat",
                table: "Rutas",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "UbicacionActualLng",
                table: "Rutas",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UbicacionActualizadaEn",
                table: "Rutas",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UbicacionActualLat",
                table: "Rutas");

            migrationBuilder.DropColumn(
                name: "UbicacionActualLng",
                table: "Rutas");

            migrationBuilder.DropColumn(
                name: "UbicacionActualizadaEn",
                table: "Rutas");
        }
    }
}
