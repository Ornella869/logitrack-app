using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class FaseAEstadoJornadaRepartidor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "EstadoJornada",
                table: "Usuarios",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EstadoJornada",
                table: "Usuarios");
        }
    }
}
