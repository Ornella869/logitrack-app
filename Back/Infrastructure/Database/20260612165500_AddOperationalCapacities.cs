using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class AddOperationalCapacities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "CapacidadCargaKg",
                table: "Usuarios",
                type: "double precision",
                nullable: true,
                defaultValue: 500.0);

            migrationBuilder.AddColumn<int>(
                name: "CapacidadAlmacenamientoPaquetes",
                table: "Sucursales",
                type: "integer",
                nullable: false,
                defaultValue: 1000);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CapacidadCargaKg",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "CapacidadAlmacenamientoPaquetes",
                table: "Sucursales");
        }
    }
}
