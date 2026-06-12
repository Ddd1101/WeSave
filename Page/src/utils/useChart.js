import { ref, onMounted, onBeforeUnmount, nextTick } from "vue";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart, RadarChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DatasetComponent,
  ToolboxComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

try {
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
    ToolboxComponent,
    CanvasRenderer,
  ]);
} catch (err) {
  console.warn("[useChart] echarts.use failed:", err);
}

let resizeHandler = null;
const instances = new Set();

function ensureResize() {
  if (resizeHandler) return;
  resizeHandler = () => {
    instances.forEach((ins) => {
      try {
        ins.resize();
      } catch (_) {
        /* ignore */
      }
    });
  };
  window.addEventListener("resize", resizeHandler);
}

export function useChart(getOption, opts = {}) {
  const el = ref(null);
  let chart = null;

  function mount() {
    if (chart) return;
    if (!el.value) return;
    try {
      chart = echarts.init(el.value, opts.theme || null, {
        renderer: "canvas",
      });
    } catch (err) {
      console.warn("[useChart] echarts.init failed:", err);
      return;
    }
    instances.add(chart);
    ensureResize();
    chart.setOption(getOption() || {});
  }

  function refresh() {
    if (!chart) {
      nextTick(() => {
        mount();
        if (chart) {
          nextTick(() => chart.resize());
        }
      });
      return;
    }
    chart.setOption(getOption() || {}, true);
    nextTick(() => {
      try {
        chart && chart.resize();
      } catch (_) {
        /* ignore */
      }
    });
  }

  function resize() {
    chart && chart.resize();
  }

  onMounted(() => {
    nextTick(() => {
      mount();
      if (chart) {
        nextTick(() => chart.resize());
      }
    });
  });

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
