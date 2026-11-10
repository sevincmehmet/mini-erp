using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniErp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CustomPagesAndDatasets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CustomPages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Icon = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    LayoutJson = table.Column<string>(type: "nvarchar(max)", maxLength: 256, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomPages", x => x.Id);
                    table.UniqueConstraint("AK_CustomPages_CompanyId_Id", x => new { x.CompanyId, x.Id });
                });

            migrationBuilder.CreateTable(
                name: "Datasets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SourceFileName = table.Column<string>(type: "nvarchar(260)", maxLength: 260, nullable: true),
                    SourceSheet = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ColumnsJson = table.Column<string>(type: "nvarchar(max)", maxLength: 256, nullable: false),
                    RowsJson = table.Column<string>(type: "nvarchar(max)", maxLength: 256, nullable: false),
                    RowCount = table.Column<int>(type: "int", nullable: false),
                    RefreshedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Datasets", x => x.Id);
                    table.UniqueConstraint("AK_Datasets_CompanyId_Id", x => new { x.CompanyId, x.Id });
                });

            migrationBuilder.CreateIndex(
                name: "IX_CustomPages_CompanyId",
                table: "CustomPages",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomPages_CompanyId_SortOrder",
                table: "CustomPages",
                columns: new[] { "CompanyId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_Datasets_CompanyId",
                table: "Datasets",
                column: "CompanyId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CustomPages");

            migrationBuilder.DropTable(
                name: "Datasets");
        }
    }
}
