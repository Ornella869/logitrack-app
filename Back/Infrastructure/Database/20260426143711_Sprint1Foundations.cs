using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    /// <inheritdoc />
    public partial class Sprint1Foundations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Rutas_Usuarios_RepartidorId",
                table: "Rutas");

            migrationBuilder.RenameColumn(
                name: "RepartidorId",
                table: "Rutas",
                newName: "RepartidorId");

            migrationBuilder.RenameIndex(
                name: "IX_Rutas_RepartidorId",
                table: "Rutas",
                newName: "IX_Rutas_RepartidorId");

            migrationBuilder.AddColumn<bool>(
                name: "Activo",
                table: "Usuarios",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            // Renombre del discriminador heredado: filas con Repartidor pasan a Repartidor.
            migrationBuilder.Sql("UPDATE \"Usuarios\" SET \"Discriminator\" = 'Repartidor' WHERE \"Discriminator\" = 'Repartidor';");

            migrationBuilder.AddColumn<string>(
                name: "Destinatario_Telefono",
                table: "Paquetes",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Remitente_Telefono",
                table: "Paquetes",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TipoEnvio",
                table: "Paquetes",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TipoPaquete",
                table: "Paquetes",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "HistorialEstadosEnvio",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PaqueteId = table.Column<Guid>(type: "uuid", nullable: false),
                    EstadoNuevo = table.Column<int>(type: "integer", nullable: false),
                    FechaHora = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: true),
                    Origen = table.Column<int>(type: "integer", nullable: false),
                    Motivo = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HistorialEstadosEnvio", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_HistorialEstadosEnvio_FechaHora",
                table: "HistorialEstadosEnvio",
                column: "FechaHora");

            migrationBuilder.CreateIndex(
                name: "IX_HistorialEstadosEnvio_PaqueteId",
                table: "HistorialEstadosEnvio",
                column: "PaqueteId");

            migrationBuilder.AddForeignKey(
                name: "FK_Rutas_Usuarios_RepartidorId",
                table: "Rutas",
                column: "RepartidorId",
                principalTable: "Usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Rutas_Usuarios_RepartidorId",
                table: "Rutas");

            migrationBuilder.DropTable(
                name: "HistorialEstadosEnvio");

            migrationBuilder.DropColumn(
                name: "Activo",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "Destinatario_Telefono",
                table: "Paquetes");

            migrationBuilder.DropColumn(
                name: "Remitente_Telefono",
                table: "Paquetes");

            migrationBuilder.DropColumn(
                name: "TipoEnvio",
                table: "Paquetes");

            migrationBuilder.DropColumn(
                name: "TipoPaquete",
                table: "Paquetes");

            migrationBuilder.RenameColumn(
                name: "RepartidorId",
                table: "Rutas",
                newName: "RepartidorId");

            migrationBuilder.RenameIndex(
                name: "IX_Rutas_RepartidorId",
                table: "Rutas",
                newName: "IX_Rutas_RepartidorId");

            migrationBuilder.AddForeignKey(
                name: "FK_Rutas_Usuarios_RepartidorId",
                table: "Rutas",
                column: "RepartidorId",
                principalTable: "Usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
