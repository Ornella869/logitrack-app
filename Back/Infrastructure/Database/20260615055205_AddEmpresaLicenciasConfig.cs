using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class AddEmpresaLicenciasConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LicenciasAlertaDias",
                table: "Empresas",
                type: "integer",
                nullable: false,
                defaultValue: 30);

            migrationBuilder.AddColumn<int>(
                name: "LicenciasHoraProcesoMinutos",
                table: "Empresas",
                type: "integer",
                nullable: false,
                defaultValue: 5);

            migrationBuilder.AddColumn<int>(
                name: "LicenciasUrgenteDias",
                table: "Empresas",
                type: "integer",
                nullable: false,
                defaultValue: 7);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LicenciasAlertaDias",
                table: "Empresas");

            migrationBuilder.DropColumn(
                name: "LicenciasHoraProcesoMinutos",
                table: "Empresas");

            migrationBuilder.DropColumn(
                name: "LicenciasUrgenteDias",
                table: "Empresas");
        }
    }
}
