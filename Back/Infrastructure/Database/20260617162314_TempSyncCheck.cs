using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class TempSyncCheck : Migration
    {
        /// <inheritdoc />
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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "HorariosPickUp");
        }
    }
}
