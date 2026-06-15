using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    public partial class AddPermisosRol : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PermisosRol",
                columns: table => new
                {
                    FuncionalidadId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Rol = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Habilitado = table.Column<bool>(type: "boolean", nullable: false),
                    ModificadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ModificadoPorId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PermisosRol", x => new { x.FuncionalidadId, x.Rol });
                });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "PermisosRol");
        }
    }
}
