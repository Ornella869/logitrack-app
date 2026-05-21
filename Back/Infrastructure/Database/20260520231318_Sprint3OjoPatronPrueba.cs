using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class Sprint3OjoPatronPrueba : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ConfiguracionesOjoPatron",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UmbralAlertness = table.Column<double>(type: "double precision", nullable: false),
                    ActualizadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConfiguracionesOjoPatron", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PruebasOjoPatron",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    FechaHora = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ScoreNeu = table.Column<double>(type: "double precision", nullable: false),
                    ScoreHap = table.Column<double>(type: "double precision", nullable: false),
                    ScoreSad = table.Column<double>(type: "double precision", nullable: false),
                    ScoreAng = table.Column<double>(type: "double precision", nullable: false),
                    AlertnessScore = table.Column<double>(type: "double precision", nullable: false),
                    UmbralUsado = table.Column<double>(type: "double precision", nullable: false),
                    Intentos = table.Column<int>(type: "integer", nullable: false),
                    Resultado = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PruebasOjoPatron", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ConfiguracionesOjoPatron");

            migrationBuilder.DropTable(
                name: "PruebasOjoPatron");
        }
    }
}
