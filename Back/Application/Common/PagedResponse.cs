namespace Back.Application.Common
{
    public class PagedResponse<T>
    {
        public List<T> Items { get; set; } = new();
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalItems { get; set; }
        public int TotalPages { get; set; }

        public static PagedResponse<T> Create(List<T> items, int page, int pageSize, int totalItems)
        {
            return new PagedResponse<T>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalItems = totalItems,
                TotalPages = Math.Max(1, (int)Math.Ceiling(totalItems / (double)pageSize))
            };
        }
    }

    public static class PaginationDefaults
    {
        public const int DefaultPage = 1;
        public const int DefaultPageSize = 10;
        public const int MaxPageSize = 100;

        public static int NormalizePage(int? page) => page.GetValueOrDefault(DefaultPage) < 1 ? DefaultPage : page.GetValueOrDefault(DefaultPage);

        public static int NormalizePageSize(int? pageSize)
        {
            var normalized = pageSize.GetValueOrDefault(DefaultPageSize);
            if (normalized < 1) return DefaultPageSize;
            return normalized > MaxPageSize ? MaxPageSize : normalized;
        }
    }
}
