using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class AddPlantillasEmail : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PlantillasEmail",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Provincia = table.Column<string>(type: "text", nullable: false),
                    Evento = table.Column<int>(type: "integer", nullable: false),
                    Asunto = table.Column<string>(type: "text", nullable: false),
                    Cuerpo = table.Column<string>(type: "text", nullable: false),
                    ModificadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ModificadoPorId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlantillasEmail", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlantillasEmail");
        }
    }
}
