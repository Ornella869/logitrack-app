using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    [DbContext(typeof(LogiTrackDbContext))]
    [Migration("20260524000100_Sprint3EnviosADomicilio")]
    public partial class Sprint3EnviosADomicilio : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "EsEnvioADomicilio",
                table: "Paquetes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ProvinciaDestino",
                table: "Paquetes",
                type: "text",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EsEnvioADomicilio",
                table: "Paquetes");

            migrationBuilder.DropColumn(
                name: "ProvinciaDestino",
                table: "Paquetes");
        }
    }
}
