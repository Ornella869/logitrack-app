using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class AddGerenteProvincia : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GerentesProvincias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    GerenteId = table.Column<Guid>(type: "uuid", nullable: false),
                    Provincia = table.Column<string>(type: "text", nullable: false),
                    CreadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GerentesProvincias", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GerentesProvincias_Usuarios_GerenteId",
                        column: x => x.GerenteId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Índices de ayuda: busquedas por gerente y asegurar unicidad por provincia
            migrationBuilder.CreateIndex(
                name: "IX_GerentesProvincias_GerenteId",
                table: "GerentesProvincias",
                column: "GerenteId");

            migrationBuilder.CreateIndex(
                name: "IX_GerentesProvincias_Provincia",
                table: "GerentesProvincias",
                column: "Provincia",
                unique: true);

            // Copiar datos existentes desde la columna CSV 'Provincia' en Usuarios hacia la nueva tabla.
            // No se elimina la columna original: esto preserva compatibilidad y evita pérdida de datos.
            migrationBuilder.Sql(@"
                WITH provincias_normalizadas AS (
                    SELECT DISTINCT ON (trim(p))
                        ""Id"" AS gerente_id,
                        trim(p) AS provincia
                    FROM ""Usuarios""
                    CROSS JOIN LATERAL unnest(string_to_array(COALESCE(""Provincia"", ''), ',')) AS p
                    WHERE COALESCE(""Provincia"", '') <> ''
                    ORDER BY trim(p), ""Id""
                )
                INSERT INTO ""GerentesProvincias"" (""Id"", ""GerenteId"", ""Provincia"", ""CreadoEn"")
                SELECT gen_random_uuid(), gerente_id, provincia, now()
                FROM provincias_normalizadas;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GerentesProvincias");
        }
    }
}
