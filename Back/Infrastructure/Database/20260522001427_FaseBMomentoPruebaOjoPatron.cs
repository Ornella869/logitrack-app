using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class FaseBMomentoPruebaOjoPatron : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Momento",
                table: "PruebasOjoPatron",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Momento",
                table: "PruebasOjoPatron");
        }
    }
}
