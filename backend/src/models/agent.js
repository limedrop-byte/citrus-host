'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Agent extends Model {
    static associate(models) {
      Agent.belongsTo(models.Server, {
        foreignKey: 'serverId',
        as: 'server'
      });
    }
  }

  Agent.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    serverId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    key: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true
    },
    lastSeen: {
      type: DataTypes.DATE
    },
    status: {
      type: DataTypes.ENUM('online', 'offline', 'error'),
      defaultValue: 'offline'
    }
  }, {
    sequelize,
    modelName: 'Agent',
    hooks: {
      beforeCreate: (agent) => {
        if (!agent.key) {
          agent.key = require('crypto').randomBytes(32).toString('hex');
        }
      }
    }
  });

  return Agent;
}; 