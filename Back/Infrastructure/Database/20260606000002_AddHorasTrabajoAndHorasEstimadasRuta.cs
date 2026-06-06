using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class AddHorasTrabajoAndHorasEstimadasRuta : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "HorasTrabajo",
                table: "Usuarios",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<float>(
                name: "HorasEstimadasRuta",
                table: "Paquetes",
                type: "real",
                nullable: false,
                defaultValue: 8f);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HorasTrabajo",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "HorasEstimadasRuta",
                table: "Paquetes");
        }
    }
}
