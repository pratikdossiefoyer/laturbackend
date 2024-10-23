import { gql } from "apollo-server-express";

export const typeDefs = gql`
  scalar Date

  type Hostel {
    _id: ID!
    name: String!
    owner: Owner!
    registerDate: Date!
    number: String!
    address: String!
    hostelType: HostelType!
    beds: Int!
    studentsPerRoom: Int!
    food: Boolean!
    foodType: FoodType
    mealOptions: [MealOption!]
    wifi: Boolean!
    ac: Boolean!
    mess: Boolean!
    solar: Boolean!
    studyRoom: Boolean!
    tuition: Boolean!
    kitchenType: KitchenType!
    verified: Boolean!
    paymentStatus: PaymentStatus!
    rentStructure: [RentStructure!]!
    feedback: [Feedback!]!
    complaints: [Complaint!]!
  }

  type Owner {
    _id: ID!
    name: String
    email: String!
    number: String
    address: String
    gender: Gender
    hostels: [Hostel!]!
  }

  type Student {
    _id: ID!
    name: String
    email: String!
    role: String
    isApproved: Boolean
    gender: Gender
    college: String
    city: String
    wishlist: [Hostel!]!
    admittedHostel: Hostel
  }

  type RentStructure {
    studentsPerRoom: Int!
    rentPerStudent: Float!
  }

  type Feedback {
    _id: ID!
    student: Student!
    rating: Int!
    comment: String
    date: Date!
  }

  type Complaint {
    _id: ID!
    student: Student!
    description: String!
    isAnonymous: Boolean!
    date: Date!
    status: ComplaintStatus!
    complaintType: ComplaintType
  }

  enum HostelType {
    boys
    girls
  }

  enum FoodType {
    veg
    nonveg
    both
  }

  enum MealOption {
    breakfast
    lunch
    dinner
    all
  }

  enum KitchenType {
    inHouse
    Outsourced
    Not_available
  }

  enum PaymentStatus {
    pending
    paid
  }

  enum Gender {
    male
    female
    other
  }

  enum ComplaintStatus {
    open
    noticed
    resolved
  }

  enum ComplaintType {
    Rooms
    Washroom
    Wi_Fi
    Cleanliness
    Food
  }

  input HostelFilters {
    hostelType: HostelType
    minBeds: Int
    maxBeds: Int
    food: Boolean
    foodType: FoodType
    wifi: Boolean
    ac: Boolean
    verified: Boolean
    minRent: Float
    maxRent: Float
    city: String
  }

  type Query {
    searchHostels(
      filters: HostelFilters
      searchTerm: String
      page: Int
      limit: Int
    ): HostelSearchResult!
    getHostel(_id: ID!): Hostel
    getOwner(_id: ID!): Owner
    getStudent(_id: ID!): Student
  }

  type HostelSearchResult {
    hostels: [Hostel!]!
    totalCount: Int!
    hasNextPage: Boolean!
  }

  type Mutation {
    createHostel(input: CreateHostelInput!): Hostel!
    updateHostel(_id: ID!, input: UpdateHostelInput!): Hostel!
    deleteHostel(_id: ID!): Boolean!
    addFeedback(hostelId: ID!, input: AddFeedbackInput!): Feedback!
    addComplaint(hostelId: ID!, input: AddComplaintInput!): Complaint!
  }

  input CreateHostelInput {
    name: String!
    ownerId: ID!
    number: String!
    address: String!
    hostelType: HostelType!
    beds: Int!
    studentsPerRoom: Int!
    food: Boolean!
    foodType: FoodType
    mealOptions: [MealOption!]
    wifi: Boolean!
    ac: Boolean!
    mess: Boolean!
    solar: Boolean!
    studyRoom: Boolean!
    tuition: Boolean!
    kitchenType: KitchenType!
    rentStructure: [RentStructureInput!]!
  }

  input UpdateHostelInput {
    name: String
    number: String
    address: String
    beds: Int
    studentsPerRoom: Int
    food: Boolean
    foodType: FoodType
    mealOptions: [MealOption!]
    wifi: Boolean
    ac: Boolean
    mess: Boolean
    solar: Boolean
    studyRoom: Boolean
    tuition: Boolean
    kitchenType: KitchenType
    rentStructure: [RentStructureInput!]
  }

  input RentStructureInput {
    studentsPerRoom: Int!
    rentPerStudent: Float!
  }

  input AddFeedbackInput {
    studentId: ID!
    rating: Int!
    comment: String
  }

  input AddComplaintInput {
    studentId: ID!
    description: String!
    isAnonymous: Boolean!
    complaintType: ComplaintType
  }
`;
