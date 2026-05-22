using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class EpicaDGerenteMultiSucursal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Provincia",
                table: "ZonasPeligrosas",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Provincia",
                table: "Usuarios",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SucursalId",
                table: "Usuarios",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProvinciasCubiertas",
                table: "Sucursales",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "SucursalId",
                table: "Paquetes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Provincia",
                table: "ConfiguracionesTarifa",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Provincia",
                table: "ConfiguracionesOjoPatron",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Provincia",
                table: "ZonasPeligrosas");

            migrationBuilder.DropColumn(
                name: "Provincia",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "SucursalId",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "ProvinciasCubiertas",
                table: "Sucursales");

            migrationBuilder.DropColumn(
                name: "SucursalId",
                table: "Paquetes");

            migrationBuilder.DropColumn(
                name: "Provincia",
                table: "ConfiguracionesTarifa");

            migrationBuilder.DropColumn(
                name: "Provincia",
                table: "ConfiguracionesOjoPatron");
        }
    }
}
