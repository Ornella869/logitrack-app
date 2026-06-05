using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back.Infrastructure.Database
{
    [DbContext(typeof(LogiTrackDbContext))]
    [Migration("20260605103000_AddIncidenciaSlaAndPickUpCapacity")]
    public partial class AddIncidenciaSlaAndPickUpCapacity : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ResueltaEn",
                table: "Incidencias",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CapacidadDiaria",
                table: "PuntosPickUp",
                type: "integer",
                nullable: false,
                defaultValue: 100);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ResueltaEn",
                table: "Incidencias");

            migrationBuilder.DropColumn(
                name: "CapacidadDiaria",
                table: "PuntosPickUp");
        }
    }
}
