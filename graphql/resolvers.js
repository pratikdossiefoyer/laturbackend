// File: src/graphql/resolvers.js
import { GraphQLScalarType, Kind } from "graphql";

export const resolvers = {
  Date: new GraphQLScalarType({
    name: "Date",
    description: "Date custom scalar type",
    parseValue(value) {
      return new Date(value);
    },
    serialize(value) {
      return value.getTime();
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.INT) {
        return new Date(parseInt(ast.value, 10));
      }
      return null;
    },
  }),

  Query: {
    searchHostels: async (
      _,
      { filters, searchTerm, page = 1, limit = 10 },
      { models, connections }
    ) => {
      let query = {};

      if (searchTerm) {
        query.$or = [
          { name: { $regex: searchTerm, $options: "i" } },
          { address: { $regex: searchTerm, $options: "i" } },
        ];
      }

      if (filters) {
        if (filters.hostelType) query.hostelType = filters.hostelType;
        if (filters.minBeds) query.beds = { $gte: filters.minBeds };
        if (filters.maxBeds)
          query.beds = { ...query.beds, $lte: filters.maxBeds };
        if (filters.food !== undefined) query.food = filters.food;
        if (filters.foodType) query.foodType = filters.foodType;
        if (filters.wifi !== undefined) query.wifi = filters.wifi;
        if (filters.ac !== undefined) query.ac = filters.ac;
        if (filters.verified !== undefined) query.verified = filters.verified;
        if (filters.city)
          query.address = { $regex: filters.city, $options: "i" };

        if (filters.minRent || filters.maxRent) {
          query["rentStructure.rentPerStudent"] = {};
          if (filters.minRent)
            query["rentStructure.rentPerStudent"].$gte = filters.minRent;
          if (filters.maxRent)
            query["rentStructure.rentPerStudent"].$lte = filters.maxRent;
        }
      }

      const totalCount = await models.Hostel.countDocuments(query);
      const hostels = await models.Hostel.find(query)
        .populate({
          path: "owner",
          model: connections.commonDB.model("Owner"),
        })
        .skip((page - 1) * limit)
        .limit(limit);

      return {
        hostels,
        totalCount,
        hasNextPage: page * limit < totalCount,
      };
    },

    getHostel: async (_, { id }, { models }) => {
      return await models.Hostel.findById(id).populate("owner");
    },

    getOwner: async (_, { id }, { models }) => {
      return await models.Owner.findById(id);
    },

    getStudent: async (_, { id }, { models }) => {
      return await models.Student.findById(id);
    },
  },

  Mutation: {
    createHostel: async (_, { input }, { models }) => {
      const newHostel = new models.Hostel(input);
      await newHostel.save();

      // Update owner's hostels array
      await models.Owner.findByIdAndUpdate(
        input.ownerId,
        { $push: { hostels: newHostel._id } },
        { new: true }
      );

      return newHostel;
    },

    updateHostel: async (_, { id, input }, { models }) => {
      return await models.Hostel.findByIdAndUpdate(id, input, { new: true });
    },

    deleteHostel: async (_, { id }, { models }) => {
      const hostel = await models.Hostel.findByIdAndDelete(id);
      if (!hostel) return false;

      // Remove hostel from owner's hostels array
      await models.Owner.findByIdAndUpdate(hostel.owner, {
        $pull: { hostels: id },
      });

      return true;
    },

    addFeedback: async (_, { hostelId, input }, { models }) => {
      const hostel = await models.Hostel.findById(hostelId);
      if (!hostel) throw new Error("Hostel not found");

      const newFeedback = {
        student: input.studentId,
        rating: input.rating,
        comment: input.comment,
        date: new Date(),
      };

      hostel.feedback.push(newFeedback);
      await hostel.save();

      return newFeedback;
    },

    addComplaint: async (_, { hostelId, input }, { models }) => {
      const hostel = await models.Hostel.findById(hostelId);
      if (!hostel) throw new Error("Hostel not found");

      const newComplaint = {
        student: input.studentId,
        description: input.description,
        isAnonymous: input.isAnonymous,
        complaintType: input.complaintType,
        date: new Date(),
        status: "open",
      };

      hostel.complaints.push(newComplaint);
      await hostel.save();

      return newComplaint;
    },
  },

  Hostel: {
    owner: async (hostel, _, { models }) => {
      return await models.Owner.findById(hostel.owner);
    },
  },

  Owner: {
    hostels: async (owner, _, { models }) => {
      return await models.Hostel.find({ _id: { $in: owner.hostels } });
    },
  },

  Student: {
    wishlist: async (student, _, { models }) => {
      return await models.Hostel.find({ _id: { $in: student.wishlist } });
    },
    admittedHostel: async (student, _, { models }) => {
      return await models.Hostel.findById(student.admittedHostel);
    },
  },

  Feedback: {
    student: async (feedback, _, { models }) => {
      return await models.Student.findById(feedback.student);
    },
  },

  Complaint: {
    student: async (complaint, _, { models }) => {
      return await models.Student.findById(complaint.student);
    },
  },
};
