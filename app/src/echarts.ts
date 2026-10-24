// Apenas os módulos necessários do ECharts.
import * as echarts from 'echarts/core';
import { MapChart, BarChart, ScatterChart, LineChart } from 'echarts/charts';
import {
  GeoComponent,
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
  MarkLineComponent,
  TitleComponent,
  AriaComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  MapChart, BarChart, ScatterChart, LineChart,
  GeoComponent, GridComponent, TooltipComponent, VisualMapComponent, MarkLineComponent, TitleComponent, AriaComponent,
  CanvasRenderer,
]);

export { echarts };
export type { EChartsType, EChartsCoreOption } from 'echarts/core';
