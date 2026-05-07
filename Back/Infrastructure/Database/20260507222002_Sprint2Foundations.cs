using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class Sprint2Foundations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "FechaCalendarizada",
                table: "Paquetes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "UbicacionActual_Latitud",
                table: "Paquetes",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "UbicacionActual_Longitud",
                table: "Paquetes",
                type: "double precision",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FechaCalendarizada",
                table: "Paquetes");

            migrationBuilder.DropColumn(
                name: "UbicacionActual_Latitud",
                table: "Paquetes");

            migrationBuilder.DropColumn(
                name: "UbicacionActual_Longitud",
                table: "Paquetes");
        }
    }
}
