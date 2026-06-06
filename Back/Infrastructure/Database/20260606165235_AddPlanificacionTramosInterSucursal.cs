using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class AddPlanificacionTramosInterSucursal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "RequiereRepartidorFullTime",
                table: "Paquetes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "TramosEnvio",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PaqueteId = table.Column<Guid>(type: "uuid", nullable: false),
                    Orden = table.Column<int>(type: "integer", nullable: false),
                    SucursalOrigenId = table.Column<Guid>(type: "uuid", nullable: false),
                    SucursalDestinoId = table.Column<Guid>(type: "uuid", nullable: true),
                    RepartidorId = table.Column<Guid>(type: "uuid", nullable: true),
                    EsUltimaMilla = table.Column<bool>(type: "boolean", nullable: false),
                    DistanciaKm = table.Column<double>(type: "double precision", nullable: false),
                    HorasEstimadas = table.Column<double>(type: "double precision", nullable: false),
                    Estado = table.Column<int>(type: "integer", nullable: false),
                    IniciadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FinalizadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TramosEnvio", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TramosEnvio_Paquetes_PaqueteId",
                        column: x => x.PaqueteId,
                        principalTable: "Paquetes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TramosEnvio_Sucursales_SucursalDestinoId",
                        column: x => x.SucursalDestinoId,
                        principalTable: "Sucursales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TramosEnvio_Sucursales_SucursalOrigenId",
                        column: x => x.SucursalOrigenId,
                        principalTable: "Sucursales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TramosEnvio_PaqueteId_Orden",
                table: "TramosEnvio",
                columns: new[] { "PaqueteId", "Orden" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TramosEnvio_SucursalDestinoId_Estado",
                table: "TramosEnvio",
                columns: new[] { "SucursalDestinoId", "Estado" });

            migrationBuilder.CreateIndex(
                name: "IX_TramosEnvio_SucursalOrigenId_Estado",
                table: "TramosEnvio",
                columns: new[] { "SucursalOrigenId", "Estado" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TramosEnvio");

            migrationBuilder.DropColumn(
                name: "RequiereRepartidorFullTime",
                table: "Paquetes");
        }
    }
}
