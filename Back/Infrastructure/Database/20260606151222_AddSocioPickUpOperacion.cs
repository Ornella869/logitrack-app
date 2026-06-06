using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class AddSocioPickUpOperacion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Usuarios"
                ADD COLUMN IF NOT EXISTS "HorasTrabajo" integer NULL;

                ALTER TABLE "Paquetes"
                ADD COLUMN IF NOT EXISTS "HorasEstimadasRuta" real NOT NULL DEFAULT 8;

                ALTER TABLE "Paquetes"
                ALTER COLUMN "HorasEstimadasRuta" DROP DEFAULT;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Paquetes"
                DROP COLUMN IF EXISTS "HorasEstimadasRuta";

                ALTER TABLE "Usuarios"
                DROP COLUMN IF EXISTS "HorasTrabajo";
                """);
        }
    }
}
