using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    public partial class AddSatisfaccionEncuesta : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SatisfaccionEncuestas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PaqueteId = table.Column<Guid>(type: "uuid", nullable: false),
                    Token = table.Column<Guid>(type: "uuid", nullable: false),
                    Calificacion = table.Column<int>(type: "integer", nullable: true),
                    Comentario = table.Column<string>(type: "text", nullable: true),
                    RespuestaEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SatisfaccionEncuestas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SatisfaccionEncuestas_Paquetes_PaqueteId",
                        column: x => x.PaqueteId,
                        principalTable: "Paquetes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SatisfaccionEncuestas_PaqueteId",
                table: "SatisfaccionEncuestas",
                column: "PaqueteId");

            migrationBuilder.CreateIndex(
                name: "IX_SatisfaccionEncuestas_Token",
                table: "SatisfaccionEncuestas",
                column: "Token",
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "SatisfaccionEncuestas");
        }
    }
}
