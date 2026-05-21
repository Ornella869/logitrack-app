using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class Sprint3CotizacionPaquete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "CostoEnvio",
                table: "Paquetes",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "CostoRecargoSeguridad",
                table: "Paquetes",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<bool>(
                name: "EsZonaPeligrosa",
                table: "Paquetes",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CostoEnvio",
                table: "Paquetes");

            migrationBuilder.DropColumn(
                name: "CostoRecargoSeguridad",
                table: "Paquetes");

            migrationBuilder.DropColumn(
                name: "EsZonaPeligrosa",
                table: "Paquetes");
        }
    }
}
