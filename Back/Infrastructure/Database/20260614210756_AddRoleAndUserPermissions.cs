using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class AddRoleAndUserPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PermisosRol",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Rol = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Permiso = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Habilitado = table.Column<bool>(type: "boolean", nullable: false),
                    ActualizadoPorId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActualizadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PermisosRol", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PermisosUsuario",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Permiso = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Habilitado = table.Column<bool>(type: "boolean", nullable: false),
                    ActualizadoPorId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActualizadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PermisosUsuario", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PermisosUsuario_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PermisosRol_Rol_Permiso",
                table: "PermisosRol",
                columns: new[] { "Rol", "Permiso" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PermisosUsuario_UsuarioId_Permiso",
                table: "PermisosUsuario",
                columns: new[] { "UsuarioId", "Permiso" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PermisosRol");

            migrationBuilder.DropTable(
                name: "PermisosUsuario");
        }
    }
}
