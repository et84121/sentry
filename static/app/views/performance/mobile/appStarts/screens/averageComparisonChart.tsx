import {useMemo} from 'react';

import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatVersion} from 'sentry/utils/formatters';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {COLD_START_TYPE} from 'sentry/views/performance/mobile/appStarts/screenSummary/startTypeSelector';
import {YAxis, YAXIS_COLUMNS} from 'sentry/views/performance/mobile/screenload/screens';
import {ScreensBarChart} from 'sentry/views/performance/mobile/screenload/screens/screenBarChart';
import {useTableQuery} from 'sentry/views/performance/mobile/screenload/screens/screensTable';
import useTruncatedReleaseNames from 'sentry/views/performance/mobile/useTruncatedRelease';
import {PRIMARY_RELEASE_COLOR} from 'sentry/views/starfish/colors';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';

interface Props {
  chartHeight?: number;
}

function transformData(data: TableDataRow[] | undefined, appStartType: string) {
  if (!defined(data)) {
    return [];
  }

  return [
    {
      seriesName: t('Average Duration'),
      data:
        data?.map(row => ({
          name: formatVersion(row.release as string),
          value:
            (row[
              YAXIS_COLUMNS[
                appStartType === COLD_START_TYPE ? YAxis.COLD_START : YAxis.WARM_START
              ]
            ] as number) ?? 0,
        })) ?? [],
      itemStyle: {
        color: PRIMARY_RELEASE_COLOR,
      },
    },
  ];
}

export function AverageComparisonChart({chartHeight}: Props) {
  const location = useLocation();
  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();
  const {selection} = usePageFilters();

  const appStartType =
    decodeScalar(location.query[SpanMetricsField.APP_START_TYPE]) ?? COLD_START_TYPE;

  const query = new MutableSearch([
    'event.type:transaction',
    'transaction.op:ui.load',
    `count_starts(measurements.app_start_${appStartType}):>0`,
  ]);
  const queryString = appendReleaseFilters(query, primaryRelease, secondaryRelease);

  const newQuery: NewQuery = {
    name: '',
    fields: ['release', `avg(measurements.app_start_${appStartType})`],
    dataset: DiscoverDatasets.METRICS,
    query: queryString,
    version: 2,
    projects: selection.projects,
  };
  const tableEventView = EventView.fromNewQueryWithLocation(newQuery, location);

  const {data, isLoading} = useTableQuery({
    eventView: tableEventView,
    enabled: !isReleasesLoading,
    referrer: 'api.starfish.mobile-startup-bar-chart',
  });

  const transformedData = useMemo(() => {
    return transformData(data?.data, appStartType);
  }, [data, appStartType]);

  const {truncatedPrimaryRelease, truncatedSecondaryRelease} = useTruncatedReleaseNames();

  return (
    <ScreensBarChart
      chartOptions={[
        {
          title:
            appStartType === COLD_START_TYPE
              ? t('Average Cold Start')
              : t('Average Warm Start'),
          yAxis: `avg(measurements.app_start_${appStartType})`,
          xAxisLabel: [
            ...(primaryRelease ? [formatVersion(primaryRelease)] : []),
            ...(secondaryRelease ? [formatVersion(secondaryRelease)] : []),
          ],
          series: transformedData,
          subtitle: primaryRelease
            ? t(
                '%s v. %s',
                truncatedPrimaryRelease,
                secondaryRelease ? truncatedSecondaryRelease : ''
              )
            : '',
        },
      ]}
      chartHeight={chartHeight}
      isLoading={isLoading || isReleasesLoading}
      chartKey={`averageStart`}
    />
  );
}
