cmake_minimum_required(VERSION 3.13.4)

project(step-70)

find_package(deal.II 9.5 REQUIRED
  HINTS ${deal.II_DIR} ${DEAL_II_DIR} $ENV{DEAL_II_DIR})

deal_ii_initialize_cached_variables()

add_executable(step-70 step-70.cc)
deal_ii_setup_target(step-70)
