using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class AddActivoOjoPatronIfMissing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "ConfiguracionesOjoPatron"
                ADD COLUMN IF NOT EXISTS "Activo" boolean NOT NULL DEFAULT TRUE;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "ConfiguracionesOjoPatron"
                DROP COLUMN IF EXISTS "Activo";
                """);
        }
    }
}
