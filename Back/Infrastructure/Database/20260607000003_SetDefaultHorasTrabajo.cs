using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class SetDefaultHorasTrabajo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Repartidores existentes quedaron con NULL después de agregar la columna.
            // Se setea el valor por defecto (8 h = Full Time) para no romper la materialización.
            migrationBuilder.Sql(@"
                UPDATE ""Usuarios""
                SET ""HorasTrabajo"" = 8
                WHERE ""HorasTrabajo"" IS NULL
                AND ""Discriminator"" = 'Repartidor'
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                UPDATE ""Usuarios""
                SET ""HorasTrabajo"" = NULL
                WHERE ""Discriminator"" = 'Repartidor'
            ");
        }
    }
}
