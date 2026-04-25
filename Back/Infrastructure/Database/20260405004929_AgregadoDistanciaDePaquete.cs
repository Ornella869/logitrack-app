using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class AgregadoDistanciaDePaquete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Sucursales",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nombre = table.Column<string>(type: "text", nullable: false),
                    Direccion = table.Column<string>(type: "text", nullable: false),
                    Ciudad = table.Column<string>(type: "text", nullable: false),
                    Telefono = table.Column<string>(type: "text", nullable: false),
                    Estado = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sucursales", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Usuarios",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nombre = table.Column<string>(type: "text", nullable: false),
                    Apellido = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    Password = table.Column<string>(type: "text", nullable: false),
                    DNI = table.Column<string>(type: "text", nullable: false),
                    Discriminator = table.Column<string>(type: "character varying(13)", maxLength: 13, nullable: false),
                    Licencia = table.Column<string>(type: "text", nullable: true),
                    Estado = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Usuarios", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Vehiculos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Patente = table.Column<string>(type: "text", nullable: false),
                    Marca = table.Column<string>(type: "text", nullable: false),
                    CapacidadCarga = table.Column<double>(type: "double precision", nullable: false),
                    Estado = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Vehiculos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Rutas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Estado = table.Column<int>(type: "integer", nullable: false),
                    IniciadoEn = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    FinalizadoEn = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RazonCancelacion = table.Column<string>(type: "text", nullable: true),
                    TransportistaId = table.Column<Guid>(type: "uuid", nullable: false),
                    VehiculoId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Rutas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Rutas_Usuarios_TransportistaId",
                        column: x => x.TransportistaId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Rutas_Vehiculos_VehiculoId",
                        column: x => x.VehiculoId,
                        principalTable: "Vehiculos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Paquetes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CodigoSeguimiento = table.Column<string>(type: "text", nullable: false),
                    Peso = table.Column<double>(type: "double precision", nullable: false),
                    Altura = table.Column<double>(type: "double precision", nullable: false),
                    Ancho = table.Column<double>(type: "double precision", nullable: false),
                    Prioridad = table.Column<float>(type: "real", nullable: false),
                    CreadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Remitente_Nombre = table.Column<string>(type: "text", nullable: false),
                    Remitente_Apellido = table.Column<string>(type: "text", nullable: false),
                    Remitente_Direccion_Calle = table.Column<string>(type: "text", nullable: false),
                    Remitente_Direccion_Ciudad = table.Column<string>(type: "text", nullable: false),
                    Remitente_Direccion_CP = table.Column<string>(type: "text", nullable: false),
                    Remitente_Direccion_Referencia = table.Column<string>(type: "text", nullable: true),
                    Remitente_Ubicacion_Latitud = table.Column<double>(type: "double precision", nullable: true),
                    Remitente_Ubicacion_Longitud = table.Column<double>(type: "double precision", nullable: true),
                    Destinatario_Nombre = table.Column<string>(type: "text", nullable: false),
                    Destinatario_Apellido = table.Column<string>(type: "text", nullable: false),
                    Destinatario_Direccion_Calle = table.Column<string>(type: "text", nullable: false),
                    Destinatario_Direccion_Ciudad = table.Column<string>(type: "text", nullable: false),
                    Destinatario_Direccion_CP = table.Column<string>(type: "text", nullable: false),
                    Destinatario_Direccion_Referencia = table.Column<string>(type: "text", nullable: true),
                    Destinatario_Ubicacion_Latitud = table.Column<double>(type: "double precision", nullable: true),
                    Destinatario_Ubicacion_Longitud = table.Column<double>(type: "double precision", nullable: true),
                    Descripcion = table.Column<string>(type: "text", nullable: true),
                    RazonCancelacion = table.Column<string>(type: "text", nullable: true),
                    Distancia = table.Column<float>(type: "real", nullable: false),
                    RutaId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Paquetes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Paquetes_Rutas_RutaId",
                        column: x => x.RutaId,
                        principalTable: "Rutas",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Paquetes_RutaId",
                table: "Paquetes",
                column: "RutaId");

            migrationBuilder.CreateIndex(
                name: "IX_Rutas_TransportistaId",
                table: "Rutas",
                column: "TransportistaId");

            migrationBuilder.CreateIndex(
                name: "IX_Rutas_VehiculoId",
                table: "Rutas",
                column: "VehiculoId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Paquetes");

            migrationBuilder.DropTable(
                name: "Sucursales");

            migrationBuilder.DropTable(
                name: "Rutas");

            migrationBuilder.DropTable(
                name: "Usuarios");

            migrationBuilder.DropTable(
                name: "Vehiculos");
        }
    }
}
