using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    public partial class AddHorariosPickUp : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "HorariosPickUp",
                columns: table => new
                {
                    PuntoPickUpId = table.Column<Guid>(type: "uuid", nullable: false),
                    DiaSemana = table.Column<int>(type: "integer", nullable: false),
                    Apertura = table.Column<TimeSpan>(type: "interval", nullable: true),
                    Cierre = table.Column<TimeSpan>(type: "interval", nullable: true),
                    Cerrado = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HorariosPickUp", x => new { x.PuntoPickUpId, x.DiaSemana });
                    table.ForeignKey(
                        name: "FK_HorariosPickUp_PuntosPickUp_PuntoPickUpId",
                        column: x => x.PuntoPickUpId,
                        principalTable: "PuntosPickUp",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "HorariosPickUp");
        }
    }
}
