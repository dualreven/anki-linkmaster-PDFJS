/**
 * Babel配置集成测试
 * 验证Vite+Babel配置是否正确集成并转换ES2022+语法
 */

describe('Babel配置集成测试', () => {
  test('应该能够正确处理ES2022私有字段语法', () => {
    class TestPrivateField {
      #privateField = 'private value';

      getPrivate() {
        return this.#privateField;
      }

      setPrivate(value) {
        this.#privateField = value;
      }
    }

    const instance = new TestPrivateField();
    expect(instance.getPrivate()).toBe('private value');
    
    instance.setPrivate('modified');
    expect(instance.getPrivate()).toBe('modified');
  });

  test('应该能够正确处理ES2022私有方法语法', () => {
    class TestPrivateMethod {
      #privateMethod() {
        return 'private method result';
      }

      publicMethod() {
        return this.#privateMethod();
      }
    }

    const instance = new TestPrivateMethod();
    expect(instance.publicMethod()).toBe('private method result');
  });

  test('应该能够正确处理类属性语法', () => {
    class TestClassProperties {
      instanceProperty = 'instance value';
      static staticProperty = 'static value';

      constructor() {
        this.constructorProperty = 'constructor value';
      }
    }

    const instance = new TestClassProperties();
    expect(instance.instanceProperty).toBe('instance value');
    expect(instance.constructorProperty).toBe('constructor value');
    expect(TestClassProperties.staticProperty).toBe('static value');
  });

  test('应该能够在严格模式下工作', () => {
    'use strict';
    
    class StrictModeTest {
      #strictPrivate = 'strict private';

      getStrictPrivate() {
        return this.#strictPrivate;
      }
    }

    const instance = new StrictModeTest();
    expect(instance.getStrictPrivate()).toBe('strict private');
  });
});