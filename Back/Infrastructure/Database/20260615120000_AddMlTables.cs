using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class AddMlTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DatosEntrenamientoTramo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PaqueteId = table.Column<Guid>(type: "uuid", nullable: false),
                    TramoId = table.Column<Guid>(type: "uuid", nullable: true),
                    SucursalOrigenId = table.Column<Guid>(type: "uuid", nullable: false),
                    SucursalDestinoId = table.Column<Guid>(type: "uuid", nullable: false),
                    FechaSalida = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FechaLlegada = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TiempoRealHoras = table.Column<double>(type: "double precision", nullable: false),
                    PesoKg = table.Column<double>(type: "double precision", nullable: false),
                    TipoEnvio = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    EsPrioritario = table.Column<bool>(type: "boolean", nullable: false),
                    DiaSemana = table.Column<int>(type: "integer", nullable: false),
                    HoraSalida = table.Column<int>(type: "integer", nullable: false),
                    CargaSucursalOrigen = table.Column<int>(type: "integer", nullable: false),
                    RepartidoresActivosDestino = table.Column<int>(type: "integer", nullable: false),
                    TuvoDemora = table.Column<bool>(type: "boolean", nullable: false),
                    EstimacionPreviaHoras = table.Column<double>(type: "double precision", nullable: true),
                    ErrorAbsolutoHoras = table.Column<double>(type: "double precision", nullable: true),
                    RegistradoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DatosEntrenamientoTramo", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AlertasRiesgoDemoraMl",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PaqueteId = table.Column<Guid>(type: "uuid", nullable: false),
                    CodigoSeguimiento = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ProbabilidadDemora = table.Column<float>(type: "real", nullable: false),
                    CausaPrincipal = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    SucursalId = table.Column<Guid>(type: "uuid", nullable: false),
                    GeneradaEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Gestionada = table.Column<bool>(type: "boolean", nullable: false),
                    GestionadaEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SupervisorId = table.Column<Guid>(type: "uuid", nullable: true),
                    LlegoATiempo = table.Column<bool>(type: "boolean", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AlertasRiesgoDemoraMl", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DatosEntrenamientoTramo_SucursalOrigen_Destino",
                table: "DatosEntrenamientoTramo",
                columns: new[] { "SucursalOrigenId", "SucursalDestinoId" });

            migrationBuilder.CreateIndex(
                name: "IX_AlertasRiesgoDemoraMl_PaqueteId",
                table: "AlertasRiesgoDemoraMl",
                column: "PaqueteId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "AlertasRiesgoDemoraMl");
            migrationBuilder.DropTable(name: "DatosEntrenamientoTramo");
        }
    }
}
