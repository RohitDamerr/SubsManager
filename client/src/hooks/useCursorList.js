// useCursorList — keyset pagination over any list endpoint returning { data, nextCursor }.
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';

export function useCursorList(key, fetchPage, params = {}, options = {}) {
  const query = useInfiniteQuery({
    queryKey: [...key, params],
    queryFn: ({ pageParam }) => fetchPage({ ...params, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: null,
    getNextPageParam: (last) => last.nextCursor || undefined,
    placeholderData: keepPreviousData,
    ...options,
  });
  const rows = query.data?.pages.flatMap((p) => p.data) ?? [];
  return { ...query, rows };
}
