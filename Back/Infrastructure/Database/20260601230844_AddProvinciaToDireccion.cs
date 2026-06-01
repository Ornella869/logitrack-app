using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class AddProvinciaToDireccion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Destinatario_Direccion_Provincia",
                table: "Paquetes",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Remitente_Direccion_Provincia",
                table: "Paquetes",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Destinatario_Direccion_Provincia",
                table: "Paquetes");

            migrationBuilder.DropColumn(
                name: "Remitente_Direccion_Provincia",
                table: "Paquetes");
        }
    }
}
