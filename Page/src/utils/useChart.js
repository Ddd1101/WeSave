import { ref, onBeforeUnmount, watch, nextTick } from "vue";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart, RadarChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  ToolboxComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  ToolboxComponent,
  CanvasRenderer,
]);

let resizeHandler = null;
const instances = new Set();

function ensureResize() {
  if (resizeHandler) return;
  resizeHandler = () => {
    instances.forEach((ins) => ins.resize());
  };
  window.addEventListener("resize", resizeHandler);
}

export function useChart(getOption, opts = {}) {
  const el = ref(null);
  let chart = null;

  function mount() {
    if (!el.value) return;
    chart = echarts.init(el.value, opts.theme || null, { renderer: "canvas" });
    instances.add(chart);
    ensureResize();
    chart.setOption(getOption() || {});
  }

  function refresh() {
    if (!chart) return;
    chart.setOption(getOption() || {}, true);
  }

  function resize() {
    chart && chart.resize();
  }

  nextTick(mount);

  onBeforeUnmount(() => {
    if (chart) {
      chart.dispose();
      instances.delete(chart);
      chart = null;
    }
  });

  return { el, refresh, resize, chart: () => chart };
}

export default echarts;
