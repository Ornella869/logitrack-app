using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class AddSolicitudesComerciales : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SolicitudesComerciales",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    NombreEmpresa = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    NombreContacto = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Email = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Telefono = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PlanInteres = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Comentarios = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Estado = table.Column<int>(type: "integer", nullable: false),
                    CreadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SolicitudesComerciales", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SolicitudesComerciales_CreadoEn",
                table: "SolicitudesComerciales",
                column: "CreadoEn");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitudesComerciales_Email",
                table: "SolicitudesComerciales",
                column: "Email");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SolicitudesComerciales");
        }
    }
}
