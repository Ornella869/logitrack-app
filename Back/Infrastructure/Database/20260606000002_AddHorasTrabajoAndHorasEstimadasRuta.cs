using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class AddHorasTrabajoAndHorasEstimadasRuta : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Usuarios"
                ADD COLUMN IF NOT EXISTS "HorasTrabajo" integer NULL;
            """);

            migrationBuilder.Sql("""
                ALTER TABLE "Paquetes"
                ADD COLUMN IF NOT EXISTS "HorasEstimadasRuta" real NOT NULL DEFAULT 8;
            """);

            migrationBuilder.Sql("""
                ALTER TABLE "Paquetes"
                ALTER COLUMN "HorasEstimadasRuta" DROP DEFAULT;
            """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Usuarios"
                DROP COLUMN IF EXISTS "HorasTrabajo";
            """);

            migrationBuilder.Sql("""
                ALTER TABLE "Paquetes"
                DROP COLUMN IF EXISTS "HorasEstimadasRuta";
            """);
        }
    }
}
