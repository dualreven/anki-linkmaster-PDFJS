/**
 * AddFiles Feature 配置
 */
export const AddFilesFeatureConfig = {
  name: "add-files",
  version: "1.0.0",
  description: "监听“添加PDF”请求，调用原生文件选择器并通过WS发送添加指令",
  dependencies: [],
  config: {
    multiple: true,
    fileType: "pdf"
  }
};

export default AddFilesFeatureConfig;

