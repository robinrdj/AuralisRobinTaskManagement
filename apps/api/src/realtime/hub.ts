import type { RealtimeMessage } from "@auralis/shared";

interface Subscriber {
  id: string;
  boardId: string;
  userId: string;
  name: string;
  color: string;
  send: (message: RealtimeMessage) => void;
}

/**
 * In-process fan-out for board updates.
 *
 * Subscribers are grouped by board, so a write only wakes the clients looking
 * at that board. This is deliberately a single-process hub: it is the right
 * size for one API instance, and the interface is narrow enough that swapping
 * in Postgres LISTEN/NOTIFY or Redis pub/sub to span instances is a change to
 * this file alone.
 */
export class RealtimeHub {
  readonly #byBoard = new Map<string, Map<string, Subscriber>>();

  subscribe(subscriber: Subscriber): () => void {
    let board = this.#byBoard.get(subscriber.boardId);
    if (!board) {
      board = new Map();
      this.#byBoard.set(subscriber.boardId, board);
    }
    board.set(subscriber.id, subscriber);
    this.#announcePresence(subscriber.boardId);

    return () => {
      const current = this.#byBoard.get(subscriber.boardId);
      if (!current) return;
      current.delete(subscriber.id);
      if (current.size === 0) {
        this.#byBoard.delete(subscriber.boardId);
      } else {
        this.#announcePresence(subscriber.boardId);
      }
    };
  }

  /** Deliver to everyone on a board. A failing subscriber cannot block the rest. */
  publish(boardId: string, message: RealtimeMessage): void {
    const board = this.#byBoard.get(boardId);
    if (!board) return;
    for (const subscriber of board.values()) {
      try {
        subscriber.send(message);
      } catch (err) {
        console.error("[realtime] delivery failed", { subscriber: subscriber.id, err });
      }
    }
  }

  subscriberCount(boardId: string): number {
    return this.#byBoard.get(boardId)?.size ?? 0;
  }

  #announcePresence(boardId: string): void {
    const board = this.#byBoard.get(boardId);
    if (!board) return;
    // One entry per user, not per connection, so two tabs show one avatar.
    const members = new Map<string, { userId: string; name: string; color: string }>();
    for (const subscriber of board.values()) {
      members.set(subscriber.userId, {
        userId: subscriber.userId,
        name: subscriber.name,
        color: subscriber.color,
      });
    }
    this.publish(boardId, { type: "presence", members: [...members.values()] });
  }
}
