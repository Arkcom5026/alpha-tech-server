'use strict';

const {
  normalizeLifecycleCommand,
  planLifecycleTransition,
} = require('./productReservationLifecycleCommands');
const {
  assertLifecycleRepository,
} = require('./productReservationLifecycleRepositoryPort');

const notFound = (command) => {
  throw Object.assign(new Error('ProductReservation was not found in the authorized branch'), {
    code: 'PRODUCT_RESERVATION_NOT_FOUND',
    statusCode: 404,
    details: {
      reservationId: command.reservationId,
      branchId: command.branchId,
    },
  });
};

const conflict = (code, message, details = null) => {
  throw Object.assign(new Error(message), {
    code,
    statusCode: 409,
    details,
  });
};

const createProductReservationLifecycleService = ({ repository, clock = () => new Date() }) => {
  const lifecycleRepository = assertLifecycleRepository(repository);

  const execute = async (input) => {
    const command = normalizeLifecycleCommand({
      ...input,
      occurredAt: input?.occurredAt || clock(),
    });

    const replay = await lifecycleRepository.findCommandReplay({
      reservationId: command.reservationId,
      branchId: command.branchId,
      commandKey: command.commandKey,
    });

    if (replay) {
      if (replay.commandType !== command.commandType) {
        conflict(
          'PRODUCT_RESERVATION_COMMAND_REPLAY_CONFLICT',
          'Lifecycle command key was already used for a different command',
          {
            commandKey: command.commandKey,
            existingCommandType: replay.commandType,
            requestedCommandType: command.commandType,
          },
        );
      }

      return Object.freeze({
        replayed: true,
        reservation: replay.reservation,
        stockReleased: Boolean(replay.stockReleased),
      });
    }

    const current = await lifecycleRepository.findForLifecycleCommand({
      reservationId: command.reservationId,
      branchId: command.branchId,
    });

    if (!current) notFound(command);

    const transition = planLifecycleTransition({
      currentStatus: current.status,
      command,
    });

    if (transition.releaseStock && current.stockReleasedAt) {
      conflict(
        'PRODUCT_RESERVATION_STOCK_ALREADY_RELEASED',
        'ProductReservation stock has already been released',
        {
          reservationId: command.reservationId,
          stockReleasedAt: current.stockReleasedAt,
        },
      );
    }

    const result = await lifecycleRepository.executeLifecycleTransition({
      command,
      transition,
      current,
    });

    return Object.freeze({
      replayed: false,
      reservation: result.reservation,
      stockReleased: Boolean(result.stockReleased),
    });
  };

  return Object.freeze({ execute });
};

module.exports = Object.freeze({
  createProductReservationLifecycleService,
});
