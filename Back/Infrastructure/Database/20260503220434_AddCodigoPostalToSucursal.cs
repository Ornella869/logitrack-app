using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class AddCodigoPostalToSucursal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CodigoPostal",
                table: "Sucursales",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CodigoPostal",
                table: "Sucursales");
        }
    }
}
