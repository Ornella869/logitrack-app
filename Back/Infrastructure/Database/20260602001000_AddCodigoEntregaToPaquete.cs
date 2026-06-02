using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

using Microsoft.EntityFrameworkCore.Infrastructure;

namespace Back.Infrastructure.Database
{
    [DbContext(typeof(LogiTrackDbContext))]
    [Migration("20260602001000_AddCodigoEntregaToPaquete")]
    public partial class AddCodigoEntregaToPaquete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CodigoEntrega",
                table: "Paquetes",
                type: "character varying(6)",
                maxLength: 6,
                nullable: false,
                defaultValue: "123456");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CodigoEntrega",
                table: "Paquetes");
        }
    }
}
