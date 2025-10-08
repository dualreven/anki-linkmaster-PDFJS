import { EventBus } from '../../../common/event/event-bus.js';
import { PDF_TRANSLATOR_EVENTS } from '../../features/pdf-translator/events.js';

describe('Global event allowlist for pdf-translator events', () => {
  it('allows emitting pdf-translator:text:selected without being blocked', () => {
    const bus = new EventBus({ enableValidation: true });

    const handler = jest.fn();
    bus.on(PDF_TRANSLATOR_EVENTS.TEXT.SELECTED, handler);

    const payload = { text: 'hello', pageNumber: 1 };
    bus.emit(PDF_TRANSLATOR_EVENTS.TEXT.SELECTED, payload);

    expect(handler).toHaveBeenCalledWith(payload);
  });
});

